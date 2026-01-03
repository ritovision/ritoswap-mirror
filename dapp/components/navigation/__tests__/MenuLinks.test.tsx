// File: components/navigation/__tests__/MenuLinks.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MenuLinks, { links as navLinks } from "../menuLinks/MenuLinks";

describe("<MenuLinks />", () => {
  it("renders one link per entry in the `links` array, with matching text & href", () => {
    render(<MenuLinks />);
    const rendered = screen.getAllByRole("link");
    // length auto‐adjusts when you change navLinks
    expect(rendered).toHaveLength(navLinks.length);

    navLinks.forEach(({ text, href }) => {
      // looks up by the link's accessible name
      const link = screen.getByRole("link", { name: text });
      expect(link).toHaveAttribute("href", href);
    });
  });

  it("invokes onClick for every link when clicked", async () => {
    const handleClick = vi.fn();
    render(<MenuLinks onClick={handleClick} />);
    const rendered = screen.getAllByRole("link");

    for (const link of rendered) {
      await userEvent.click(link);
    }
    // again, uses navLinks.length
    expect(handleClick).toHaveBeenCalledTimes(navLinks.length);
  });
});
