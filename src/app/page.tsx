"use client";

import { useState, useEffect } from "react";
import { Play, Pause, SkipForward, X, Dumbbell, Trophy, Calendar, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { seedDefaultUser } from "@/lib/seed-user";

// Tipos
type Exercise = {
  id: string;
  name: string;
  duration_seconds: number;
  image_url: string | null;
  instructions: string | null;
};

type User = {
  id: string;
  email: string;
};

export default function PowerHit15() {
  // Estados de autenticação
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Estados do treino
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<Exercise[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  // Verifica sessão ao carregar E cria usuário padrão se necessário
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Primeiro, tenta criar/logar o usuário padrão
      await seedDefaultUser();
      
      // Depois verifica a sessão
      await checkSession();
    } catch (error) {
      console.error("Erro ao inicializar app:", error);
      setLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser({ id: session.user.id, email: session.user.email || "" });
        setIsLoggedIn(true);
        await loadExercises();
        await loadUserProgress(session.user.id);
      }
    } catch (error) {
      console.error("Erro ao verificar sessão:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carrega exercícios do banco
  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name");

      if (error) throw error;

      if (data && data.length > 0) {
        setAllExercises(data);
        const workout = generateDailyWorkout(data, new Date());
        setTodayWorkout(workout);
      }
    } catch (error) {
      console.error("Erro ao carregar exercícios:", error);
    }
  };

  // Gera treino do dia baseado na data
  const generateDailyWorkout = (exercises: Exercise[], date: Date): Exercise[] => {
    if (exercises.length === 0) return [];
    
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    const seed = dayOfYear;
    
    // Shuffle baseado no seed
    const shuffled = [...exercises].sort(() => {
      const random = Math.sin(seed) * 10000;
      return random - Math.floor(random);
    });
    
    // Seleciona 6 exercícios para um treino de ~15min
    return shuffled.slice(0, 6);
  };

  // Carrega progresso do usuário
  const loadUserProgress = async (userId: string) => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("workout_progress")
        .select("workout_date")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("workout_date", startOfMonth.toISOString().split("T")[0]);

      if (error) throw error;

      if (data) {
        const dates = data.map(item => item.workout_date);
        setCompletedDays(dates);
      }
    } catch (error) {
      console.error("Erro ao carregar progresso:", error);
    }
  };

  // Salva progresso do usuário
  const saveWorkoutProgress = async () => {
    if (!currentUser) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      
      const { error } = await supabase
        .from("workout_progress")
        .upsert({
          user_id: currentUser.id,
          workout_date: today,
          completed: true,
          exercises_completed: todayWorkout.length,
          total_exercises: todayWorkout.length,
          duration_seconds: todayWorkout.reduce((acc, ex) => acc + ex.duration_seconds, 0)
        }, {
          onConflict: "user_id,workout_date"
        });

      if (error) throw error;

      // Atualiza lista local
      if (!completedDays.includes(today)) {
        setCompletedDays([...completedDays, today]);
      }
    } catch (error) {
      console.error("Erro ao salvar progresso:", error);
    }
  };

  // Registro
  const handleRegister = async () => {
    setError("");
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError("Preencha todos os campos");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setCurrentUser({ id: data.user.id, email: data.user.email || "" });
        setIsLoggedIn(true);
        await loadExercises();
        setEmail("");
        setPassword("");
      }
    } catch (error: any) {
      setError(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  // Login
  const handleLogin = async () => {
    setError("");
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError("Preencha todos os campos");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setCurrentUser({ id: data.user.id, email: data.user.email || "" });
        setIsLoggedIn(true);
        await loadExercises();
        await loadUserProgress(data.user.id);
        setEmail("");
        setPassword("");
      }
    } catch (error: any) {
      setError(error.message || "Email ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setCompletedDays([]);
      setIsWorkoutActive(false);
      setTodayWorkout([]);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  // Timer
  useEffect(() => {
    if (!isWorkoutActive || isPaused || timeLeft === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (isResting) {
            // Fim do descanso, próximo exercício
            if (currentExerciseIndex < todayWorkout.length - 1) {
              setCurrentExerciseIndex((prev) => prev + 1);
              setIsResting(false);
              return todayWorkout[currentExerciseIndex + 1].duration_seconds;
            } else {
              // Treino completo!
              completeWorkout();
              return 0;
            }
          } else {
            // Fim do exercício, inicia descanso (15s padrão)
            setIsResting(true);
            return 15;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isWorkoutActive, isPaused, timeLeft, isResting, currentExerciseIndex, todayWorkout]);

  const startWorkout = () => {
    setIsWorkoutActive(true);
    setCurrentExerciseIndex(0);
    setIsResting(false);
    setTimeLeft(todayWorkout[0].duration_seconds);
    setShowInstructions(false);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const skipExercise = () => {
    if (currentExerciseIndex < todayWorkout.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
      setIsResting(false);
      setTimeLeft(todayWorkout[currentExerciseIndex + 1].duration_seconds);
    } else {
      completeWorkout();
    }
  };

  const stopWorkout = () => {
    setIsWorkoutActive(false);
    setIsPaused(false);
    setCurrentExerciseIndex(0);
    setIsResting(false);
  };

  const completeWorkout = async () => {
    await saveWorkoutProgress();
    setIsWorkoutActive(false);
    setIsPaused(false);
    setCurrentExerciseIndex(0);
  };

  const currentExercise = todayWorkout[currentExerciseIndex];
  const progress = todayWorkout.length > 0 ? ((currentExerciseIndex + 1) / todayWorkout.length) * 100 : 0;
  const monthProgress = (completedDays.length / 30) * 100;

  // Loading inicial
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-2xl shadow-purple-500/50 mb-4 animate-pulse">
            <Dumbbell className="w-10 h-10 text-white" />
          </div>
          <p className="text-purple-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Tela de Login
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-2xl shadow-purple-500/50 mb-4">
              <Dumbbell className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent mb-2">
              PowerHit15
            </h1>
            <p className="text-gray-400">Treinos de 15 minutos em casa</p>
          </div>

          {/* Card de Login */}
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/20 rounded-2xl p-8 border border-purple-800/30 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">
              {isRegistering ? "Criar Conta" : "Entrar"}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (isRegistering ? handleRegister() : handleLogin())}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 bg-black/50 border border-purple-800/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (isRegistering ? handleRegister() : handleLogin())}
                  placeholder="Digite sua senha"
                  className="w-full px-4 py-3 bg-black/50 border border-purple-800/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all"
                />
              </div>

              {/* Botão Principal */}
              <button
                onClick={isRegistering ? handleRegister : handleLogin}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-xl font-bold text-lg transition-all shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Carregando..." : (isRegistering ? "Criar Conta" : "Entrar")}
              </button>

              {/* Toggle Login/Registro */}
              <div className="text-center pt-2">
                <button
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError("");
                  }}
                  className="text-purple-400 hover:text-purple-300 text-sm font-semibold transition-colors"
                >
                  {isRegistering ? "Já tem conta? Entrar" : "Não tem conta? Criar agora"}
                </button>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>💪 Treinos diários variados</p>
            <p>⏱️ Apenas 15 minutos por dia</p>
            <p>🏆 Acompanhe seu progresso</p>
          </div>

          {/* Credenciais de Teste */}
          <div className="mt-4 p-4 bg-purple-900/20 rounded-xl border border-purple-800/30 text-center">
            <p className="text-xs text-gray-400 mb-2">🔑 Credenciais de teste:</p>
            <p className="text-sm text-purple-300 font-mono">castrosilva1222@gmail.com</p>
            <p className="text-sm text-purple-300 font-mono">123456</p>
          </div>
        </div>
      </div>
    );
  }

  if (todayWorkout.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-purple-500 mb-4">Carregando treino...</div>
          <p className="text-gray-400 text-sm">Preparando seus exercícios do dia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black text-white">
      {/* Header */}
      <header className="p-6 border-b border-purple-900/30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Dumbbell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                PowerHit15
              </h1>
              <p className="text-xs text-gray-400">Olá, {currentUser?.email.split("@")[0]}!</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Progresso Mensal */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-purple-400" />
              <div className="text-right">
                <div className="text-sm text-gray-400">Este mês</div>
                <div className="text-lg font-bold text-purple-400">{completedDays.length} dias</div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-purple-900/30 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5 text-gray-400 hover:text-purple-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 pb-20">
        {!isWorkoutActive ? (
          // Tela Inicial
          <div className="space-y-8">
            {/* Progresso do Mês */}
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/20 rounded-2xl p-6 border border-purple-800/30 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold">Progresso do Mês</h2>
              </div>
              <div className="relative h-4 bg-black/50 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500 shadow-lg shadow-purple-500/50"
                  style={{ width: `${monthProgress}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-gray-400">{completedDays.length} de 30 dias</span>
                <span className="text-purple-400 font-bold">{Math.round(monthProgress)}%</span>
              </div>
            </div>

            {/* Treino do Dia */}
            <div className="bg-gradient-to-br from-purple-900/20 to-black rounded-2xl p-8 border border-purple-800/30 shadow-2xl">
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                Treino de Hoje
              </h2>
              <p className="text-gray-400 mb-6">
                {todayWorkout.length} exercícios • ~15 minutos
              </p>

              {/* Lista de Exercícios */}
              <div className="space-y-3 mb-8">
                {todayWorkout.map((exercise, index) => (
                  <div 
                    key={exercise.id}
                    className="flex items-center gap-4 p-4 bg-black/40 rounded-xl border border-purple-900/20 hover:border-purple-700/50 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 font-bold border border-purple-600/30">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{exercise.name}</div>
                      <div className="text-sm text-gray-400">{exercise.duration_seconds}s</div>
                    </div>
                    <div className="text-sm text-purple-400 font-mono">
                      {exercise.duration_seconds}s
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão Iniciar */}
              <button
                onClick={startWorkout}
                className="w-full py-5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-xl font-bold text-lg transition-all shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Play className="w-6 h-6" fill="currentColor" />
                Começar Treino
              </button>
            </div>
          </div>
        ) : (
          // Tela de Execução do Treino
          <div className="space-y-6">
            {/* Barra de Progresso */}
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/20 rounded-2xl p-6 border border-purple-800/30">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-400">
                  Exercício {currentExerciseIndex + 1} de {todayWorkout.length}
                </span>
                <span className="text-sm text-purple-400 font-bold">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="relative h-3 bg-black/50 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-300 shadow-lg shadow-purple-500/50"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Card do Exercício */}
            <div className="bg-gradient-to-br from-purple-900/20 to-black rounded-2xl overflow-hidden border border-purple-800/30 shadow-2xl">
              {/* Imagem */}
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={currentExercise.image_url || "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=300&fit=crop"} 
                  alt={currentExercise.name}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <h3 className="text-3xl font-bold mb-1">{currentExercise.name}</h3>
                  <p className="text-purple-300">{currentExercise.duration_seconds}s</p>
                </div>
              </div>

              {/* Timer */}
              <div className="p-8 text-center">
                <div className="mb-4">
                  <div className={`text-sm font-semibold mb-2 ${isResting ? 'text-purple-400' : 'text-white'}`}>
                    {isResting ? '⏸️ DESCANSO' : '💪 EXECUTANDO'}
                  </div>
                  <div className={`text-8xl font-bold font-mono ${isResting ? 'text-purple-400' : 'text-white'} ${timeLeft <= 5 && !isResting ? 'animate-pulse' : ''}`}>
                    {timeLeft}
                  </div>
                  <div className="text-gray-400 text-sm mt-2">segundos</div>
                </div>

                {/* Instruções */}
                {!isResting && currentExercise.instructions && (
                  <div className="mt-6 p-4 bg-purple-900/20 rounded-xl border border-purple-800/30">
                    <button
                      onClick={() => setShowInstructions(!showInstructions)}
                      className="text-purple-400 text-sm font-semibold mb-2 hover:text-purple-300 transition-colors"
                    >
                      {showInstructions ? '▼' : '▶'} Como executar
                    </button>
                    {showInstructions && (
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {currentExercise.instructions}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Controles */}
            <div className="flex gap-3">
              <button
                onClick={stopWorkout}
                className="flex-1 py-4 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Parar
              </button>
              <button
                onClick={togglePause}
                className="flex-1 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isPaused ? <Play className="w-5 h-5" fill="currentColor" /> : <Pause className="w-5 h-5" fill="currentColor" />}
                {isPaused ? 'Continuar' : 'Pausar'}
              </button>
              <button
                onClick={skipExercise}
                className="flex-1 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                <SkipForward className="w-5 h-5" />
                Pular
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
