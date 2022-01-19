import { makeExecutableSchema } from "@graphql-tools/schema";
import { stitchSchemas } from "@graphql-tools/stitch";
import { stitchingDirectives } from "@graphql-tools/stitching-directives";
import { AsyncExecutor } from "@graphql-tools/utils";
import { introspectSchema, wrapSchema } from "@graphql-tools/wrap";
import { ApolloServer } from "apollo-server";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core";
import { ApolloServer as ApolloExpressServer } from "apollo-server-express";
import { fetch } from "cross-undici-fetch";
import express from "express";
import { print } from "graphql";
import { PubSub } from "graphql-subscriptions";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import { WebSocketServer } from "ws";

const pubsub = new PubSub();

(async () => {
  const {
    allStitchingDirectivesTypeDefs,
    stitchingDirectivesValidator,
    stitchingDirectivesTransformer,
  } = stitchingDirectives();

  const db = {
    users: [{ id: "1", name: "Sammy", favouriteProducts: ["1"] }],
    products: [{ id: "1", name: "T-shirt" }],
  };

  const productsTypeDefs = `
  ${allStitchingDirectivesTypeDefs}

  type Product {
    id: ID!
    name: String!
  }

  type User {
    favouriteProducts: [Product!]!
    hello: String
  }

type Mutation {
  sammy: String
}
  
  type Subscription {
    sammy: String
  }

  type Query {
    products: [Product!]!

    # merge resolvers
    _sdl: String!
    mergedUsers(ids: [ID!]!): [User!]!
  }
`;

  const productsSchema = stitchingDirectivesValidator(
    makeExecutableSchema({
      typeDefs: productsTypeDefs,
      resolvers: {
        Query: {
          products: () => db.products,

          _sdl: () => productsTypeDefs,
          mergedUsers: (root, { ids }) => ids.map((id: any) => ({ id })),
        },
        Mutation: {
          sammy: () => {
            pubsub.publish("POST_CREATED", {
              sammy: "event!",
            });

            return "sammy";
          },
        },
        Subscription: {
          sammy: {
            subscribe: () => pubsub.asyncIterator(["POST_CREATED"]),
          },
        },
        User: {
          favouriteProducts: () => db.products,
          hello: () => "world",
        },
      },
    }),
  );

  const productsServer = new ApolloServer({
    schema: productsSchema,
    plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
  })
    .listen({ port: 4001 })
    .then(({ url }) => console.log(`running on ${url}`));

  const executor: AsyncExecutor = async ({ document, variables }) => {
    const query = print(document);
    console.log(query);
    const fetchResult = await fetch("http://localhost:4001/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    return fetchResult.json();
  };

  const remoteProductsSchema = wrapSchema({
    schema: await introspectSchema(executor),
    executor,
  });

  const usersSchema = makeExecutableSchema({
    typeDefs: `
      type User {
        id: ID!
        name: String
      }

      type Query {
        users: [User!]!
      }
    `,
    resolvers: {
      Query: {
        users: () => db.users,
      },
    },
  });

  const productsSubschema = {
    schema: remoteProductsSchema,
    merge: {
      User: {
        fieldName: "mergedUsers",
        selectionSet: "{ id }",
        key: ({ id }: any) => id,
        argsFromKeys: (ids: any) => ({ ids }),
      },
    },
  };
  const usersSubschema = {
    schema: usersSchema,
  };

  // build the combined schema
  const gatewaySchema = stitchSchemas({
    subschemaConfigTransforms: [stitchingDirectivesTransformer],
    subschemas: [productsSubschema, usersSubschema],
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
