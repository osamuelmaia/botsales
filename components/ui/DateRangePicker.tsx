"use client"

import { useState, useEffect, useMemo } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isWithinInterval,
  isAfter, isBefore, addMonths, subMonths, subDays, parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"

interface Props {
  value: { from: string; to: string } | null
  onChange: (range: { from: string; to: string }) => void
  placeholder?: string
}

function toIso(d: Date) { return format(d, "yyyy-MM-dd") }

function buildPresets() {
  const now = new Date()
  const t = toIso(now)
  return [
    { label: "Hoje",        range: { from: t, to: t } },
    { label: "Ontem",       range: { from: toIso(subDays(now, 1)), to: toIso(subDays(now, 1)) } },
    { label: "7 dias",      range: { from: toIso(subDays(now, 7)), to: t } },
    { label: "14 dias",     range: { from: toIso(subDays(now, 14)), to: t } },
    { label: "30 dias",     range: { from: toIso(subDays(now, 30)), to: t } },
    { label: "Este mês",    range: { from: toIso(startOfMonth(now)), to: t } },
    { label: "Mês passado", range: { from: toIso(startOfMonth(subMonths(now, 1))), to: toIso(endOfMonth(subMonths(now, 1))) } },
    { label: "3 meses",     range: { from: toIso(subDays(now, 90)), to: t } },
    { label: "6 meses",     range: { from: toIso(subDays(now, 180)), to: t } },
  ]
}

export function DateRangePicker({ value, onChange, placeholder = "Período" }: Props) {
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState<Date>(() => value?.from ? parseISO(value.from) : new Date())
  const [draft, setDraft]   = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })
  const [hover, setHover]   = useState<Date | null>(null)

  const presets = useMemo(() => buildPresets(), [open])

  useEffect(() => {
    if (open) {
      setDraft({
        from: value?.from ? parseISO(value.from) : null,
        to:   value?.to   ? parseISO(value.to)   : null,
      })
      setCursor(value?.from ? parseISO(value.from) : new Date())
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeLabel = useMemo(() => {
    if (!value) return null
    return presets.find(p => p.range.from === value.from && p.range.to === value.to)?.label ?? null
  }, [value, presets])

  const triggerLabel = activeLabel
    ?? (value?.from && value?.to
      ? `${format(parseISO(value.from), "dd MMM", { locale: ptBR })} → ${format(parseISO(value.to), "dd MMM", { locale: ptBR })}`
      : placeholder)

  function selectPreset(range: { from: string; to: string }) {
    onChange(range)
    setOpen(false)
  }

  function pickDay(day: Date) {
    if (!draft.from || (draft.from && draft.to)) {
      setDraft({ from: day, to: null })
      return
    }
    const [a, b] = isBefore(day, draft.from) ? [day, draft.from] : [draft.from, day]
    onChange({ from: toIso(a), to: toIso(b) })
    setOpen(false)
  }

  // Calendar grid
  const monthStart = startOfMonth(cursor)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd    = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
  const days: Date[] = []
  for (let d = gridStart; !isAfter(d, gridEnd); d = addDays(d, 1)) days.push(d)

  // Range preview while selecting second date
  const previewEnd = draft.from && !draft.to ? hover : null

  const rangeFrom = draft.from
  const rangeTo   = draft.to ?? previewEnd

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            value?.from && value?.to
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
          }`}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {triggerLabel}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 bg-white rounded-xl border border-gray-200 shadow-xl flex overflow-hidden animate-fade-in"
        >
          {/* ── Left: presets ──────────────────────────────────────── */}
          <div className="w-[130px] border-r border-gray-100 py-2 shrink-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pb-2">Período</p>
            {presets.map((p) => {
              const active = value?.from === p.range.from && value?.to === p.range.to
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => selectPreset(p.range)}
                  className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* ── Right: calendar ────────────────────────────────────── */}
          <div className="p-4 w-[290px]">
            {/* Selected range pills */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-md px-2.5 py-1 min-w-[90px] text-center">
                {draft.from ? format(draft.from, "dd MMM yyyy", { locale: ptBR }) : "—"}
              </span>
              <span className="text-gray-300 text-xs">→</span>
              <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-md px-2.5 py-1 min-w-[90px] text-center">
                {rangeTo ? format(rangeTo, "dd MMM yyyy", { locale: ptBR }) : "—"}
              </span>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setCursor(subMonths(cursor, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-gray-900 capitalize">
                {format(cursor, "MMMM yyyy", { locale: ptBR })}
              </span>
              <button type="button" onClick={() => setCursor(addMonths(cursor, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
                <div key={d} className="text-[10px] font-semibold text-gray-400 text-center py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const inMonth = isSameMonth(day, cursor)
                const isToday = isSameDay(day, new Date())
                const isStart = rangeFrom && isSameDay(day, rangeFrom)
                const isEnd   = rangeTo   && isSameDay(day, rangeTo)
                const isEdge  = isStart || isEnd
                const inRange = rangeFrom && rangeTo && isWithinInterval(day, {
                  start: isBefore(rangeFrom, rangeTo) ? rangeFrom : rangeTo,
                  end:   isBefore(rangeFrom, rangeTo) ? rangeTo   : rangeFrom,
                })

                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => inMonth && pickDay(day)}
                    onMouseEnter={() => setHover(day)}
                    onMouseLeave={() => setHover(null)}
                    className={[
                      "h-8 w-full text-xs flex items-center justify-center transition-colors select-none",
                      !inMonth && "text-gray-200 cursor-default",
                      inMonth && !isEdge && !inRange && "text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-full",
                      inRange && !isEdge && "bg-indigo-50 text-indigo-700",
                      isEdge && "bg-indigo-600 text-white font-semibold rounded-full",
                      !isEdge && isToday && inMonth && "font-bold",
                    ].filter(Boolean).join(" ")}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>

            {/* Hint */}
            <p className="text-[11px] text-gray-400 text-center mt-3">
              {!draft.from || (draft.from && draft.to)
                ? "Clique numa data para começar"
                : "Agora clique na data final"}
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
