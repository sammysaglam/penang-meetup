import fs from "fs";
import { PubSub, withFilter } from "graphql-subscriptions";
import path from "path";

import { createMicroservice } from "../utils/create-microservice";

const pubsub = new PubSub();

const NAME = "Products";
const PORT = 4001;

const db = {
  products: [{ id: "1", name: "T-shirt" }],
};

export const productsMicroservice = () =>
  createMicroservice({
    label: NAME,
    port: PORT,
    typeDefs: fs.readFileSync(
      path.join(__dirname, "products.graphql"),
      "utf-8",
    ),
    resolvers: {
      Query: {
        products: () => db.products,
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
          subscribe: withFilter(
            () => pubsub.asyncIterator(["POST_CREATED"]),
            (payload, variables, context) => {
              console.log({
                subscriptionContext: context,
              });

              return true;
            },
          ),
        },
      },
      User: {
        favouriteProducts: () => db.products,
        hello: () => "world",
      },
      Product: {
        id: (root, args, context) => {
          console.log({ queryContext: context });
          return root.id;
        },
      },
    },
    context: ({ req }) => ({
      jwt: req.headers.authorization,
    }),
    subscriptionContext: ({ connectionParams }) => ({
      jwt: connectionParams?.authorization,
    }),
  });
