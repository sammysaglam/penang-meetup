import React, { useState } from "react";
import styled from "styled-components";

import {
  useGetProductsQuery,
  useUpdateProductMutation,
} from "../../slide-3-type-safety/generated";

const StyledWrapper = styled.table`
  margin: 24px;

  td {
    border: solid 1px #ccc;
    padding: 8px 12px;
  }
`;

export const App = () => {
  const [newName, setNewName] = useState("");

  const { data } = useGetProductsQuery();
  const [update] = useUpdateProductMutation();

  return (
    <>
      <StyledWrapper>
        <thead>
          <tr>
            <th>id</th>
            <th>name</th>
            <th>description</th>
            <th>price</th>
            <th>qty</th>
          </tr>
        </thead>
        <tbody>
          {data?.products?.map(({ id, name, description, price, stockQty }) => (
            <tr key={id}>
              <td>{id}</td>
              <td>{name}</td>
              <td>{description}</td>
              <td>{price}</td>
              <td>{stockQty}</td>
            </tr>
          ))}
        </tbody>
      </StyledWrapper>

      <input
        onChange={(event) => setNewName(event?.target.value)}
        value={newName}
      />
      <button
        onClick={() => update({ variables: { id: "1", newName } })}
        type="button"
      >
        Update Product #1 name
      </button>
    </>
  );
};
