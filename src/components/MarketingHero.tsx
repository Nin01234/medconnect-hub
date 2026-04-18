import type { HeroRotation } from "@/lib/marketingRotations";

function accentClass(a: HeroRotation["line1Accent"]) {
  return a === "primary" ? "text-primary" : "text-accent";
}

export function MarketingHeroHeading({
  rotation,
  className = "font-display text-5xl lg:text-7xl font-bold mt-6 leading-[1.05]",
}: {
  rotation: HeroRotation;
  className?: string;
}) {
  return (
    <h1 className={className}>
      {rotation.line1Before}
      <span className={accentClass(rotation.line1Accent)}>{rotation.line1Highlight}</span>
      <br />
      {rotation.line2Before}
      <span className={accentClass(rotation.line2Accent)}>{rotation.line2Highlight}</span>
    </h1>
  );
}
