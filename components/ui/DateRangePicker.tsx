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
      ? `${format(parseISO(value.from), "dd MMM", { locale: ptBR })} – ${format(parseISO(value.to), "dd MMM", { locale: ptBR })}`
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

  const monthStart = startOfMonth(cursor)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd    = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
  const days: Date[] = []
  for (let d = gridStart; !isAfter(d, gridEnd); d = addDays(d, 1)) days.push(d)

  const previewEnd = draft.from && !draft.to ? hover : null
  const rangeFrom  = draft.from
  const rangeTo    = draft.to ?? previewEnd

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`h-8 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap border ${
            value?.from && value?.to
              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
              : "bg-white border-gray-200 text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
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
          className="z-50 bg-white rounded-2xl border border-gray-100 flex overflow-hidden"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.13)" }}
        >
          {/* ── Presets ────────────────────────────────────────────── */}
          <div className="w-36 bg-gray-50/80 border-r border-gray-100 py-3 flex flex-col shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">
              Atalhos
            </p>
            <div className="flex flex-col gap-0.5 px-2">
              {presets.map((p) => {
                const active = value?.from === p.range.from && value?.to === p.range.to
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => selectPreset(p.range)}
                    className={`px-3 py-1.5 rounded-lg text-sm text-left font-medium transition-all ${
                      active
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Calendar ───────────────────────────────────────────── */}
          <div className="p-5 w-72">

            {/* Range summary */}
            <div className="flex items-stretch gap-0 mb-4 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
              <div className="flex-1 text-center py-2 px-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Início</p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums">
                  {draft.from ? format(draft.from, "dd MMM", { locale: ptBR }) : <span className="text-gray-300">—</span>}
                </p>
              </div>
              <div className="w-px bg-gray-200 self-stretch" />
              <div className="flex-1 text-center py-2 px-3">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Fim</p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums">
                  {rangeTo ? format(rangeTo, "dd MMM", { locale: ptBR }) : <span className="text-gray-300">—</span>}
                </p>
              </div>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setCursor(subMonths(cursor, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-gray-900 capitalize">
                {format(cursor, "MMMM yyyy", { locale: ptBR })}
              </span>
              <button
                type="button"
                onClick={() => setCursor(addMonths(cursor, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {["D","S","T","Q","Q","S","S"].map((d, i) => (
                <div key={i} className="text-[10px] font-bold text-gray-300 text-center py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid — uses relative wrapper for continuous range band */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const inMonth  = isSameMonth(day, cursor)
                const isToday  = isSameDay(day, new Date())
                const isStart  = !!(rangeFrom && isSameDay(day, rangeFrom))
                const isEnd    = !!(rangeTo   && isSameDay(day, rangeTo))
                const isEdge   = isStart || isEnd
                const isSingle = isStart && isEnd
                const inRange  = !!(rangeFrom && rangeTo && !isSameDay(rangeFrom, rangeTo) &&
                  isWithinInterval(day, {
                    start: isBefore(rangeFrom, rangeTo) ? rangeFrom : rangeTo,
                    end:   isBefore(rangeFrom, rangeTo) ? rangeTo   : rangeFrom,
                  }))

                // Half-bands that connect start/end circles to the range fill
                const bandRight = isStart && !isSingle && !!rangeTo
                const bandLeft  = isEnd   && !isSingle && !!rangeFrom

                return (
                  <div key={i} className="relative h-8">
                    {/* Continuous band between selected dates */}
                    {inRange   && <div className="absolute inset-y-1.5 inset-x-0 bg-indigo-50" />}
                    {bandRight && <div className="absolute inset-y-1.5 left-1/2 right-0 bg-indigo-50" />}
                    {bandLeft  && <div className="absolute inset-y-1.5 left-0 right-1/2 bg-indigo-50" />}

                    <button
                      type="button"
                      onClick={() => inMonth && pickDay(day)}
                      onMouseEnter={() => setHover(day)}
                      onMouseLeave={() => setHover(null)}
                      disabled={!inMonth}
                      className={[
                        "absolute inset-0 flex items-center justify-center text-xs rounded-full transition-colors select-none z-10",
                        !inMonth  && "text-gray-200 cursor-default",
                        inMonth && !isEdge && !inRange && "text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer",
                        inRange  && !isEdge && "text-indigo-600 font-medium",
                        isEdge   && inMonth && "bg-indigo-600 text-white font-bold shadow-sm",
                        isToday  && !isEdge && inMonth && "font-bold underline decoration-indigo-300 decoration-2 underline-offset-2",
                      ].filter(Boolean).join(" ")}
                    >
                      {format(day, "d")}
                    </button>
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-gray-400 text-center mt-3">
              {!draft.from || (draft.from && draft.to)
                ? "Clique para escolher a data inicial"
                : "Agora escolha a data final"}
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
