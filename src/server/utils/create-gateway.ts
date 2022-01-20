import { makeExecutableSchema } from "@graphql-tools/schema";
import { stitchSchemas } from "@graphql-tools/stitch";
import { stitchingDirectives } from "@graphql-tools/stitching-directives";
import { AsyncExecutor, observableToAsyncIterable } from "@graphql-tools/utils";
import { FilterRootFields, FilterTypes, wrapSchema } from "@graphql-tools/wrap";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import { ApolloServer as ApolloExpressServer } from "apollo-server-express";
import { fetch } from "cross-undici-fetch";
import express from "express";
import { getOperationAST, OperationTypeNode, print } from "graphql";
import gql from "graphql-tag";
import { createClient } from "graphql-ws";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

type CreateGatewayParameters = {
  port?: number;
  microservices: { endpoint: string }[];
};

export const createGateway = async ({
  microservices,
  port,
}: CreateGatewayParameters) => {
  const { stitchingDirectivesTransformer } = stitchingDirectives();

  const remoteSchemas = await Promise.all(
    microservices.map(async ({ endpoint }) => {
      const httpExecutor: AsyncExecutor = async ({
        document,
        variables,
        operationName,
        extensions,
      }) => {
        const query = print(document);

        const fetchResult = await fetch(`http://${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query, variables, operationName, extensions }),
        });
        return fetchResult.json();
      };

      const subscriptionClient = createClient({
        url: `ws://${endpoint}`,
        webSocketImpl: WebSocket,
      });

      const wsExecutor: AsyncExecutor = async ({
        document,
        variables,
        operationName,
        extensions,
      }) =>
        observableToAsyncIterable({
          subscribe: (observer) => ({
            unsubscribe: subscriptionClient.subscribe(
              {
                query: print(document),
                variables: variables as Record<string, any>,
                operationName,
                extensions,
              },
              {
                next: (data) => observer.next && observer.next(data as any),
                error: (err) => {
                  if (!observer.error) {
                    return;
                  }
                  if (err instanceof Error) {
                    observer.error(err);
                  } else if (err instanceof CloseEvent) {
                    observer.error(
                      new Error(`Socket closed with event ${err.code}`),
                    );
                  } else if (Array.isArray(err)) {
                    // graphQLError[]
                    observer.error(
                      new Error(err.map(({ message }) => message).join(", ")),
                    );
                  }
                },
                complete: () => observer.complete && observer.complete(),
              },
            ),
          }),
        });

      const executor: AsyncExecutor = async (args) => {
        // get the operation node of from the document that should be executed
        const operation = getOperationAST(args.document, args.operationName);
        // subscription operations should be handled by the wsExecutor
        if (operation?.operation === OperationTypeNode.SUBSCRIPTION) {
          return wsExecutor(args);
        }
        // all other operations should be handles by the httpExecutor
        return httpExecutor(args);
      };

      const sdlResponse: any = await httpExecutor({
        document: gql`
          {
            _sdl
          }
        `,
      });

      const sdl = sdlResponse?.data?._sdl;

      if (!sdl) {
        throw new Error("microservice SDL could not be found!");
      }

      const remoteSchema = wrapSchema({
        schema: makeExecutableSchema({ typeDefs: sdl }),
        executor,
      });

      return {
        schema: remoteSchema,
      };
    }),
  );

  // build the combined schema
  const gatewaySchema = stitchSchemas({
    subschemaConfigTransforms: [stitchingDirectivesTransformer],
    subschemas: remoteSchemas,
  });

  const finalSchema = wrapSchema({
    schema: gatewaySchema,
    transforms: [
      new FilterTypes((type) => {
        switch (type.name) {
          case "_Entity":
            return false;

          default:
            return true;
        }
      }),
      new FilterRootFields((operationName, fieldName, fieldConfig) => {
        if (operationName === "Query") {
          console.log(fieldName);
          switch (fieldName) {
            case "_sdl":
              return false;

            default:
              return true;
          }
        }

        return true;
      }),
    ],
  });

  const app = express();
  const httpServer = http.createServer(app);

  const apolloServer = new ApolloExpressServer({
    schema: finalSchema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({ app, path: "/graphql", cors: true });

  const server = app.listen(port || 4000, () => {
    // create and use the websocket server
    const wsServer = new WebSocketServer({
      server,
      path: "/graphql",
    });

    useServer({ schema: finalSchema }, wsServer);

    console.log(`🚀 Gateway ready at http://localhost:4000/graphql`);
  });

  return { expressApp: app };
};
