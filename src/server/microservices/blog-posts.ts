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

const NAME = "Blog Posts";
const PORT = 4003;

const db = {
  blogPosts: [{ id: "1", title: "T-shirt" }],
};

export const blogPostsMicroservice = async () => {
  const typeDefs = `
    type BlogPost {
      id: ID!
      title: String!
    }

    extend type User @key(fields: "id") {
      id: ID! @external
      blogPosts: [BlogPost!]!
    }

    extend type Product @key(fields: "id") {
      id: ID! @external
      relevantBlogPostsForProduct: [BlogPost!]!
    }

    type Query {
      blogPosts: [BlogPost!]!
    }
  `;

  const config = stitchingDirectives();
  const stitchingSDL = federationToStitchingSDL(typeDefs, config);

  const executableSchema = makeExecutableSchema({
    typeDefs: stitchingSDL,
    resolvers: {
      Query: {
        blogPosts: () => db.blogPosts,
        _entities: (root, { representations }) =>
          representations.map((representation: any) => representation),
      },
      User: {
        blogPosts: () => db.blogPosts,
      },
      Product: {
        relevantBlogPostsForProduct: () => db.blogPosts,
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
