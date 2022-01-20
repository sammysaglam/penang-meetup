import fs from "fs";
import path from "path";

import { createMicroservice } from "../utils/create-microservice";

const NAME = "Blog Posts";
const PORT = 4003;

const db = {
  blogPosts: [{ id: "1", title: "T-shirt" }],
};

export const blogPostsMicroservice = () =>
  createMicroservice({
    label: NAME,
    port: PORT,
    typeDefs: fs.readFileSync(
      path.join(__dirname, "blog-posts.graphql"),
      "utf-8",
    ),
    resolvers: {
      Query: {
        blogPosts: () => db.blogPosts,
      },
      User: {
        blogPosts: (root) => {
          console.log("x", { root });

          return db.blogPosts;
        },
      },
      Product: {
        relevantBlogPostsForProduct: () => db.blogPosts,
      },
    },
  });
