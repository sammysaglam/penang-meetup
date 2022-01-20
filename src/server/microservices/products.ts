import fs from "fs";
import { PubSub } from "graphql-subscriptions";
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
    },
  });
