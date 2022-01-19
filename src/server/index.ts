import { stitchSchemas } from "@graphql-tools/stitch";
import { stitchingDirectives } from "@graphql-tools/stitching-directives";
import { AsyncExecutor, observableToAsyncIterable } from "@graphql-tools/utils";
import { introspectSchema, wrapSchema } from "@graphql-tools/wrap";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core";
import { ApolloServer as ApolloExpressServer } from "apollo-server-express";
import { fetch } from "cross-undici-fetch";
import express from "express";
import {
  getOperationAST,
  OperationTypeNode,
  print,
  printSchema,
} from "graphql";
import { createClient } from "graphql-ws";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

import { blogPostsMicroservice } from "./microservices/blog-posts";
import { productsMicroservice } from "./microservices/products";
import { usersMicroservice } from "./microservices/users";

const { stitchingDirectivesTransformer } = stitchingDirectives();

(async () => {
  const microservices = await Promise.all([
    productsMicroservice(),
    usersMicroservice(),
    blogPostsMicroservice(),
  ]);

  const remoteSchemas = await Promise.all(
    microservices.map(async (endpoint) => {
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

      const remoteSchema = wrapSchema({
        schema: await introspectSchema(executor),
        executor,
      });

      const mergeTypes = Object.fromEntries(
        (remoteSchema as any)._typeMap._Entity?._types?.map((type: any) => [
          type.name,
          {
            fieldName: "_entities",
            selectionSet: "{ id }",
            key: ({ id }: any) => id,
            argsFromKeys: (ids: any) => ({
              representations: ids.map((id: string) => ({
                __typename: type.name,
                id,
              })),
            }),
          },
        ]) || [],
      );

      return {
        schema: remoteSchema,
        merge: mergeTypes,
      };
    }),
  );

  // build the combined schema
  const gatewaySchema = stitchSchemas({
    subschemaConfigTransforms: [stitchingDirectivesTransformer],
    subschemas: remoteSchemas,
  });

  const app = express();
  const httpServer = http.createServer(app);

  const apolloServer = new ApolloExpressServer({
    schema: gatewaySchema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({ app, path: "/graphql" });

  const server = app.listen(4000, () => {
    // create and use the websocket server
    const wsServer = new WebSocketServer({
      server,
      path: "/graphql",
    });

    useServer({ schema: gatewaySchema }, wsServer);

    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
  });
})();
