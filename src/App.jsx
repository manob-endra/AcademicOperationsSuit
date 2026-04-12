import { useEffect } from "react";
import { supabase } from "./supabaseClient";

function App() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from('test_table')   // you can change later
        .select('*');

      console.log("DATA:", data);
      console.log("ERROR:", error);
    }
    testConnection();
  }, []);

  return <h1>Checking Supabase connection...</h1>;
}

export default App;