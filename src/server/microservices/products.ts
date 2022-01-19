import { makeExecutableSchema } from "@graphql-tools/schema";
import { stitchingDirectives } from "@graphql-tools/stitching-directives";
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

const pubsub = new PubSub();

const NAME = "Products";
const PORT = 4001;

const db = {
  products: [{ id: "1", name: "T-shirt" }],
};

const { allStitchingDirectivesTypeDefs, stitchingDirectivesValidator } =
  stitchingDirectives();

export const productsMicroservice = async () => {
  const typeDefs = `
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

  const executableSchema = stitchingDirectivesValidator(
    makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          products: () => db.products,

          _sdl: () => typeDefs,
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
