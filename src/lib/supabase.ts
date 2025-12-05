import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos do banco
export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export type WorkoutProgress = {
  id: string;
  user_id: string;
  completed_date: string;
  exercises_completed: number;
  total_duration: number;
  created_at: string;
};

export type Exercise = {
  id: string;
  name: string;
  duration: number;
  rest: number;
  reps: string;
  instructions: string;
  image: string;
  category: string;
};
