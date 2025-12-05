import { supabase } from "./supabase";

/**
 * Cria usuário padrão para testes
 * Email: castrosilva1222@gmail.com
 * Senha: 123456
 */
export async function seedDefaultUser() {
  try {
    // Verifica se já existe sessão ativa
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log("Usuário já está logado");
      return { success: true, message: "Usuário já logado" };
    }

    // Tenta fazer login primeiro (caso usuário já exista)
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: "castrosilva1222@gmail.com",
      password: "123456",
    });

    if (loginData.user) {
      console.log("Login realizado com sucesso!");
      return { success: true, message: "Login realizado", user: loginData.user };
    }

    // Se login falhou, tenta criar o usuário
    if (loginError) {
      console.log("Usuário não existe, criando...");
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: "castrosilva1222@gmail.com",
        password: "123456",
      });

      if (signUpError) {
        console.error("Erro ao criar usuário:", signUpError.message);
        return { success: false, error: signUpError.message };
      }

      if (signUpData.user) {
        console.log("Usuário criado com sucesso!");
        return { success: true, message: "Usuário criado", user: signUpData.user };
      }
    }

    return { success: false, error: "Erro desconhecido" };
  } catch (error: any) {
    console.error("Erro no seed:", error);
    return { success: false, error: error.message };
  }
}
