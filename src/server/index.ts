import { makeExecutableSchema } from "@graphql-tools/schema";
import { stitchSchemas } from "@graphql-tools/stitch";
import { stitchingDirectives } from "@graphql-tools/stitching-directives";
import { ApolloServer } from "apollo-server";

const {
  allStitchingDirectivesTypeDefs,
  stitchingDirectivesValidator,
  stitchingDirectivesTransformer,
} = stitchingDirectives();

const db = {
  users: [{ id: "1", name: "Sammy", favouriteProducts: ["1"] }],
  products: [{ id: "1", name: "T-shirt" }],
};

const productsTypeDefs = `
  ${allStitchingDirectivesTypeDefs}

  type Product {
    id: ID!
    name: String!
  }

  type User {
    favouriteProducts: [Product!]!
    hello: String
  }

  type Query {
    products: [Product!]!

    # merge resolvers
    _sdl: String!
    mergedUsers(ids: [ID!]!): [User!]! @merge(keyField: "id")
  }
`;

const productsSchema = stitchingDirectivesValidator(
  makeExecutableSchema({
    typeDefs: productsTypeDefs,
    resolvers: {
      Query: {
        products: () => db.products,

        _sdl: () => productsTypeDefs,
        mergedUsers: (root, { ids }) => ids.map((id: any) => ({ id })),
      },
      User: {
        favouriteProducts: () => db.products,
        hello: () => "world",
      },
    },
  }),
);

const usersSchema = makeExecutableSchema({
  typeDefs: `
    type User {
      id: ID!
      name: String
    }

    type Query {
      users: [User!]!
    }
  `,
  resolvers: {
    Query: {
      users: () => db.users,
    },
  },
});

const productsSubschema = {
  schema: productsSchema,
};
const usersSubschema = {
  schema: usersSchema,
};

// build the combined schema
const gatewaySchema = stitchSchemas({
  subschemaConfigTransforms: [stitchingDirectivesTransformer],
  subschemas: [productsSubschema, usersSubschema],
});

new ApolloServer({
  schema: gatewaySchema,
})
  .listen()
  .then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  });
