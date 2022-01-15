import { ApolloServer } from "apollo-server";
import fs from "fs";
import path from "path";

const products: any = {
  "1": {
    id: "1",
    name: "Product 1",
    description: "Product 1 is very beautiful",
    price: 45.22,
    stockQty: 3,
  },
  "2": {
    id: "2",
    name: "Product 2",
    description: "Product 2 is very beautiful",
    price: 123.23,
    stockQty: 66,
  },
  "3": {
    id: "3",
    name: "Product 3",
    description: "Product 3 is very beautiful",
    price: 123.23,
    stockQty: 66,
  },
};

const users: any = {
  "1": {
    id: "1",
    firstName: "Sammy",
    lastName: "Saglam",
    address: {
      line1: "12 Super street",
      line2: null,
      city: "London",
      country: "United Kingdom",
      postCode: "SW1 5KY",
    },
    favouriteProducts: ["1", "3"],
  },
};

const server = new ApolloServer({
  typeDefs: fs.readFileSync(path.join(__dirname, "schema.graphql"), "utf-8"),
  resolvers: {
    Query: {
      hello: () => "world",
      products: () => [
        {
          id: "1",
        },
        {
          id: "2",
        },
        {
          id: "3",
        },
      ],
      users: () => [
        {
          id: "1",
        },
      ],
    },
    Mutation: {
      updateProduct: (_, { id, newName }) => ({ id, newName }),
    },
    Product: {
      name: ({ id, newName }: any) => newName || products[id].name,
      description: ({ id }: any) => products[id].description,
      price: ({ id }: any) => products[id].price,
      stockQty: ({ id }: any) => products[id].stockQty,
    },
    User: {
      firstName: ({ id }: any) => users[id].firstName,
      lastName: ({ id }: any) => users[id].lastName,
      address: ({ id }: any) => users[id].address,
      favouriteProducts: ({ id }: any) =>
        users[id].favouriteProducts.map((productId: any) => ({
          id: productId,
        })),
    },
  },
});

server.listen().then(({ url }: any) => {
  console.log(`🚀  Server ready at ${url}`);
});
