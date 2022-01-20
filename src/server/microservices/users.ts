import fs from "fs";
import path from "path";

import { createMicroservice } from "../utils/create-microservice";

const NAME = "Users";
const PORT = 4002;

const db = {
  users: [
    { userId: "1", name: "Sammy", sammyId: "dude", sammy: { bro: "bro" } },
  ],
};

export const usersMicroservice = () =>
  createMicroservice({
    label: NAME,
    port: PORT,
    typeDefs: fs.readFileSync(path.join(__dirname, "users.graphql"), "utf-8"),
    resolvers: {
      Query: {
        users: () => db.users,
      },
    },
  });
