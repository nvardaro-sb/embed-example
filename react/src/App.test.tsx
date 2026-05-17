import React from "react";
import { render } from "@testing-library/react";
import EmbedPage from "./EmbedPage";

test("renders header or embed env hint", () => {
  const { container } = render(<EmbedPage />);
  expect(container.textContent).toMatch(
    /Superblocks Embedded App Example|REACT_APP_SUPERBLOCKS_EMBED_SRC/
  );
});
