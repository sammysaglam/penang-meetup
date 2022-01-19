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

const NAME = "Users";
const PORT = 4002;

const db = {
  users: [{ id: "1", name: "Sammy" }],
};

export const usersMicroservice = async () => {
  const typeDefs = `
    type User {
      id: ID!
      name: String
    }

    type Query {
      users: [User!]!
    }
  `;

  const config = stitchingDirectives();
  const stitchingSDL = federationToStitchingSDL(typeDefs, config);

  const executableSchema = makeExecutableSchema({
    typeDefs: stitchingSDL,
    resolvers: {
      Query: {
        users: () => db.users,
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
