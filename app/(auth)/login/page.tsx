"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"

const inputCls =
  "w-full h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [redirecting, setRedirecting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setError("")
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setError("E-mail ou senha inválidos")
      return
    }

    setRedirecting(true)
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
      {/* Subtle background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">BotFlows</span>
            <span className="w-2 h-2 rounded-full bg-blue-600 mb-0.5" />
          </div>
          <p className="text-sm text-gray-500">Vendas automatizadas no Telegram</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/80 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Acesse sua conta</h2>
            <p className="text-sm text-gray-500 mt-1">Bem-vindo de volta!</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-gray-600 uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  {...register("email")}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className={`${inputCls} pl-9`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-gray-600 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${inputCls} pl-9 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                {...register("remember")}
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-blue-600"
              />
              <label htmlFor="remember" className="text-sm text-gray-500 cursor-pointer select-none">
                Lembrar de mim
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || redirecting}
              className="w-full h-11 rounded-xl bg-[#111627] text-white text-sm font-semibold hover:bg-[#1c2434] active:bg-[#0a0f1c] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm shadow-black/10 mt-2"
            >
              {(isSubmitting || redirecting) && <Loader2 className="h-4 w-4 animate-spin" />}
              {redirecting ? "Redirecionando..." : isSubmitting ? "Verificando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Não tem conta?{" "}
            <Link href="/register" className="text-blue-600 font-medium hover:text-blue-500 transition-colors">
              Cadastre-se grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
