import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "Nova Labs — Virtual Internship Programme",
};

export default function LandingPage() {
  return <LandingClient />;
}
