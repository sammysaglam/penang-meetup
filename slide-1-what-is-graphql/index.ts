import { createServer } from "graphql-yoga";

const server = createServer({
  typeDefs: `
    type Query {
      ping: String
    }
  `,
  resolvers: {
    Query: {
      ping: () => "pong",
    },
  },
});

server.start();
