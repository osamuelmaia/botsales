"use client"

import { useState, useEffect } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isAfter,
  isBefore,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns"
import { ptBR } from "date-fns/locale"

interface Props {
  value: { from: string; to: string } | null  // YYYY-MM-DD strings
  onChange: (range: { from: string; to: string }) => void
  placeholder?: string
}

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export function DateRangePicker({ value, onChange, placeholder = "Selecionar período" }: Props) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState<Date>(() => (value?.from ? parseISO(value.from) : new Date()))
  const [draft, setDraft] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })

  useEffect(() => {
    if (open) {
      setDraft({
        from: value?.from ? parseISO(value.from) : null,
        to:   value?.to   ? parseISO(value.to)   : null,
      })
      setCursor(value?.from ? parseISO(value.from) : new Date())
    }
  }, [open, value])

  function handleDayClick(day: Date) {
    if (!draft.from || (draft.from && draft.to)) {
      setDraft({ from: day, to: null })
      return
    }
    if (isBefore(day, draft.from)) {
      setDraft({ from: day, to: draft.from })
    } else {
      setDraft({ from: draft.from, to: day })
    }
  }

  function apply() {
    if (draft.from && draft.to) {
      onChange({ from: toIsoDate(draft.from), to: toIsoDate(draft.to) })
      setOpen(false)
    }
  }

  function reset() {
    setDraft({ from: null, to: null })
  }

  const label =
    value?.from && value?.to
      ? `${format(parseISO(value.from), "dd MMM", { locale: ptBR })} → ${format(parseISO(value.to), "dd MMM", { locale: ptBR })}`
      : placeholder

  // Build month grid
  const monthStart = startOfMonth(cursor)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd    = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
  const days: Date[] = []
  for (let d = gridStart; !isAfter(d, gridEnd); d = addDays(d, 1)) days.push(d)

  const weekdayLabels = ["D", "S", "T", "Q", "Q", "S", "S"]

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
            value?.from && value?.to
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
          }`}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 bg-white rounded-xl border border-gray-200 shadow-lg p-3 w-[300px] animate-fade-in"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setCursor(subMonths(cursor, 1))}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-900 capitalize">
              {format(cursor, "MMMM yyyy", { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {weekdayLabels.map((d, i) => (
              <div key={i} className="text-[10px] font-semibold text-gray-400 text-center py-1 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              const inMonth   = isSameMonth(day, cursor)
              const isFrom    = draft.from && isSameDay(day, draft.from)
              const isTo      = draft.to   && isSameDay(day, draft.to)
              const inRange   = draft.from && draft.to && isWithinInterval(day, { start: draft.from, end: draft.to })
              const isEdge    = isFrom || isTo
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={[
                    "h-8 w-full text-xs rounded-md transition-colors relative",
                    !inMonth && "text-gray-300",
                    inMonth && !inRange && !isEdge && "text-gray-700 hover:bg-blue-50",
                    inRange && !isEdge && "bg-blue-50 text-blue-700 rounded-none",
                    isEdge && "bg-blue-600 text-white font-semibold",
                  ].filter(Boolean).join(" ")}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Limpar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 px-3 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!draft.from || !draft.to}
                className="h-7 px-3 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
