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

  await createGateway({
    microservices,

    buildHeaders: (context: any) => ({
      "authorization": context?.jwt,
    }),
    buildSubscriptionConnectionParams: (context: any) => ({
      "authorization": context?.jwt,
    }),

    context: ({ req }) => ({
      jwt: req.headers.authorization,
    }),
    subscriptionContext: ({ connectionParams }) => ({
      jwt: connectionParams?.authorization,
    }),
  });
})();
