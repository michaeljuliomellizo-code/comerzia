import Image from "next/image";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className
      )}
    >
      <Image
        src="/comerzia-logo.svg"
        alt="Logo de COMERZIA"
        width={36}
        height={36}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

export function LogoWordmark({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span
        className={cn(
          "text-lg font-extrabold leading-none tracking-tight",
          dark ? "text-white" : "text-foreground"
        )}
      >
        COMER
        <span className="text-primary">ZIA</span>
      </span>
    </span>
  );
}
