// Screenshot and layout check for one page, with optional fake clock and settings.
// Usage and examples: docs/VERIFY.md

import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"

import puppeteer from "puppeteer-core"

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:3123" },
    page: { type: "string", default: "" }, // layar, bulanan; empty = home. No leading slash: Git Bash rewrites it
    size: { type: "string", default: "1920x1080" },
    mobile: { type: "boolean", default: false },
    at: { type: "string" }, // fake clock, e.g. 2026-10-23T11:46:00+07:00
    cycle: { type: "string" }, // TV slide cycle length in seconds, used with --offset
    offset: { type: "string" }, // seconds into that cycle
    settings: { type: "string" }, // JSON, or a path to a JSON file
    click: { type: "string" }, // exact button text to click after load
    wait: { type: "string", default: "2500" },
    out: { type: "string", default: join(tmpdir(), "jadwal-shot.png") },
    browser: {
      type: "string",
      default: process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    },
  },
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const [width, height] = args.size.split("x").map(Number)

function fakeTime() {
  if (!args.at) return null
  const at = new Date(args.at).getTime()
  // The server sends schedules from the real today, so other dates give nonsense countdowns.
  const days = (at - Date.now()) / 86_400_000
  if (!(days > -1 && days < 60)) throw new Error("--at must be within the next 60 days (see docs/VERIFY.md)")
  if (!args.cycle) return at
  const cycle = Number(args.cycle) * 1000
  return at - (at % cycle) + Number(args.offset ?? 0) * 1000
}

function readSettings() {
  if (!args.settings) return null
  return JSON.parse(existsSync(args.settings) ? readFileSync(args.settings, "utf8") : args.settings)
}

const browser = await puppeteer.launch({ executablePath: args.browser, headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width, height, isMobile: args.mobile, hasTouch: args.mobile })

  await page.evaluateOnNewDocument(
    (settings, time) => {
      if (settings) localStorage.setItem("jadwal-shalat:settings", JSON.stringify(settings))
      if (time) {
        const shift = time - Date.now()
        const RealDate = Date
        window.Date = class extends RealDate {
          constructor(...a) {
            if (a.length) super(...a)
            else super(RealDate.now() + shift)
          }
          static now() {
            return RealDate.now() + shift
          }
        }
      }
    },
    readSettings(),
    fakeTime()
  )

  await page.goto(`${args.base}/${args.page}`, { waitUntil: "networkidle0", timeout: 60_000 })
  await sleep(Number(args.wait))

  if (args.click) {
    // Controls on the TV page hide while the mouse is idle.
    await page.mouse.move(width / 2, height / 2)
    const [button] = await page.$$(`xpath/.//button[normalize-space()='${args.click}']`)
    if (!button) throw new Error(`Button not found: ${args.click}`)
    await button.evaluate((el) => el.click())
    await sleep(1500)
  }

  await page.screenshot({ path: args.out })

  const report = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
    }
    const main = document.querySelector("main")
    const content = main?.firstElementChild
    const dialog = document.querySelector("[role=alertdialog]")
    return {
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      middle:
        location.pathname === "/layar" && content
          ? { space: box(main), content: box(content), fits: box(content).top >= box(main).top && box(content).bottom <= box(main).bottom }
          : undefined,
      dialog: dialog
        ? { ...box(dialog), fits: box(dialog).top >= 0 && box(dialog).bottom <= innerHeight, scrollbar: dialog.scrollHeight > dialog.clientHeight + 1 }
        : undefined,
      text: (main ?? document.body).innerText.replace(/\s+/g, " ").slice(0, 200),
    }
  })
  console.log(JSON.stringify({ out: args.out, ...report }, null, 2))
} finally {
  await browser.close()
}
