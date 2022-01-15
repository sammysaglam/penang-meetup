import { gql, useQuery } from "@apollo/client";
import React from "react";
import styled from "styled-components";

const StyledWrapper = styled.div`
  padding: 24px;
  white-space: pre-wrap;
`;

export const App = () => {
  const { data } = useQuery(gql`
    query GetAllProducts {
      products {
        id
        name
        description
        price
        stockQty
      }
    }
  `);

  return (
    <StyledWrapper>Hello world {JSON.stringify(data, null, 2)}</StyledWrapper>
  );
};
