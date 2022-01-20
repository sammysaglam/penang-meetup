import { makeExecutableSchema } from "@graphql-tools/schema";
import {
  federationToStitchingSDL,
  stitchingDirectives,
} from "@graphql-tools/stitching-directives";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core";
import { ApolloServer as ApolloExpressServer } from "apollo-server-express";
import express from "express";
import { PubSub } from "graphql-subscriptions";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import { WebSocketServer } from "ws";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pubsub = new PubSub();

const NAME = "Products";
const PORT = 4001;

const db = {
  products: [{ id: "1", name: "T-shirt" }],
};

export const productsMicroservice = async () => {
  const typeDefs = `
    type Product {
      id: ID!
      name: String!
    }

    extend type User @key(fields: "userId sammyId") {
      userId: ID! @external
      sammyId: String! @external
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
      _sdl: String!
    }
  `;

  const config = stitchingDirectives();
  const stitchingSDL = federationToStitchingSDL(typeDefs, config);

  const executableSchema = makeExecutableSchema({
    typeDefs: stitchingSDL,
    resolvers: {
      Query: {
        products: () => db.products,

        _sdl: () => stitchingSDL,
        _entities: (root, { representations }) =>
          representations.map((representation: any) => representation),
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
      Product: {
        id: (root) => {
          console.log({ root });
          return root.id;
        },
      },
      _Entity: {
        __resolveType: ({ __typename }: any) => __typename,
      },
    },
  });

  const app = express();
  const httpServer = http.createServer(app);

  const apolloExpressServer = new ApolloExpressServer({
    schema: executableSchema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  });

  await apolloExpressServer.start();

  apolloExpressServer.applyMiddleware({ app, path: "/graphql" });

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      // create and use the websocket server
      const wsServer = new WebSocketServer({
        server,
        path: "/graphql",
      });

      useServer({ schema: executableSchema }, wsServer);

      console.log(
        `🚀 ${NAME} microservice ready at http://localhost:${PORT}/graphql`,
      );

      resolve(`localhost:${PORT}/graphql`);
    });
  });
};
