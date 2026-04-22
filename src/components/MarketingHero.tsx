import type { HeroRotation } from "@/lib/marketingRotations";

export function MarketingHeroHeading({
  rotation,
  className = "text-4xl lg:text-6xl font-semibold mt-6 leading-tight tracking-tight text-foreground",
}: {
  rotation: HeroRotation;
  className?: string;
}) {
  return (
    <h1 className={className}>
      {rotation.line1Before}{rotation.line1Highlight}
      <br />
      {rotation.line2Before}{rotation.line2Highlight}
    </h1>
  );
}
