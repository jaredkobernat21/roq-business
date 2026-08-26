export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-sm font-semibold text-accent-foreground">
          S
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">ROQ Business</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
