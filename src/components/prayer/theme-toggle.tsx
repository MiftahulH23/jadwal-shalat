"use client"

import { MoonStarIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useHydrated } from "@/hooks/use-persisted-state"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useHydrated()

  const isDark = mounted && resolvedTheme === "dark"
  const label = isDark ? "Mode terang" : "Mode gelap"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-10 rounded-full bg-card/60 backdrop-blur"
            aria-label={label}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
        }
      >
        <SunIcon className="scale-100 rotate-0 transition-transform duration-500 dark:scale-0 dark:-rotate-90" />
        <MoonStarIcon className="absolute scale-0 rotate-90 transition-transform duration-500 dark:scale-100 dark:rotate-0" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
