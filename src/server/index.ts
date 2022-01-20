import { blogPostsMicroservice } from "./microservices/blog-posts";
import { productsMicroservice } from "./microservices/products";
import { usersMicroservice } from "./microservices/users";
import { createGateway } from "./utils/create-gateway";

(async () => {
  const microservices = await Promise.all([
    productsMicroservice(),
    usersMicroservice(),
    blogPostsMicroservice(),
  ]);

  await createGateway({ microservices });
})();
