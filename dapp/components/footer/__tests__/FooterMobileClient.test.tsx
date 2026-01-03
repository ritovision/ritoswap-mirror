
// components/footer/__tests__/FooterMobileClient.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";

// 1) Mock next/image so `priority` won't leak into the DOM
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    const { priority, ...imgProps } = props;
    return <img src={src} alt={alt} {...imgProps} />;
  },
}));

// 2) Mock next/link so Link renders as <a>
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// 3) Stub out all footer‐utility children
vi.mock(
  "@/components/footer/utilities/footerMenu/FooterMenuClient",
  () => ({
    __esModule: true,
    default: () => <div data-testid="footer-menu-client" />,
  })
);
vi.mock(
  "@/components/footer/utilities/footerSocials/FooterSocialsClient",
  () => ({
    __esModule: true,
    default: () => <div data-testid="footer-socials-client" />,
  })
);
// Fix: Mock LogoArrayClient instead of CobrandClient
vi.mock(
  "@/components/footer/utilities/logoArray/LogoArrayClient",
  () => ({
    __esModule: true,
    default: () => <div data-testid="cobrand-client" />,
  })
);
vi.mock(
  "@/components/footer/utilities/footerLegal/FooterLegalClient",
  () => ({
    __esModule: true,
    default: () => <div data-testid="footer-legal-client" />,
  })
);

import FooterMobileClient from "../footerMobile/FooterMobileClient";

describe("<FooterMobileClient />", () => {
  it("renders the logo, children, and all footer utilities", () => {
    render(
      <FooterMobileClient>
        <p data-testid="child">Hello, Footer!</p>
      </FooterMobileClient>
    );

    // root footer
    const footer = screen.getByTestId("footer");
    expect(footer).toBeInTheDocument();

    // logo link + image
    const logoLink = screen.getByRole("link", { name: /RitoSwap Logo/i });
    expect(logoLink).toHaveAttribute("href", "/");
    const logoImg = screen.getByRole("img", { name: /RitoSwap Logo/i });
    expect(logoImg).toHaveAttribute("src", "/images/brand/ritoswap.png");

    // children prop
    expect(screen.getByTestId("child")).toHaveTextContent("Hello, Footer!");

    // all stubbed footer utilities
    expect(screen.getByTestId("footer-menu-client")).toBeInTheDocument();
    expect(screen.getByTestId("footer-socials-client")).toBeInTheDocument();
    expect(screen.getByTestId("cobrand-client")).toBeInTheDocument();
    expect(screen.getByTestId("footer-legal-client")).toBeInTheDocument();
  });
});