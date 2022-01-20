import { gql, useQuery, useSubscription } from "@apollo/client";
import React from "react";

export const App = () => {
  const { data } = useQuery(
    gql`
      {
        users {
          userId
          name
          hello
          favouriteProducts {
            id
            name
          }
        }
      }
    `,
  );

  const { data: data2 } = useSubscription(gql`
    subscription {
      sammy
    }
  `);

  console.log("subscription:", data2);

  return (
    <div style={{ whiteSpace: "pre-wrap" }}>
      sammy was here {JSON.stringify(data, null, 2)}
    </div>
  );
};
