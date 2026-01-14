import { supabase } from '../utils/Supabase.js';



export const addFixedTransaction = async (req, res) => {
    const { description, amount, type, player_id, currency } = req.body
    try {
        const { data, error } = await supabase.from("fixed_transactions").insert([{ description, amount, type, player_id, currency }]).select()

        if (error) return res.status(400).json({ error: "Error al crear transacción fija" })

        res.status(200).json({ message: "Transacción creada correctamente" })

    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" })
        console.log(error);
    }
}


export const updateFixedTransaction = async (req, res) => {
    const { id } = req.params;
    const transactionData = req.body;
    try {
        const { error } = await supabase.from("fixed_transactions").update([{ ...transactionData }]).eq("id", id);

        if (error) res.status(404).json({ error: "Error al actualizar la transacción" });

        res.status(200).json({ message: "Transacción actualizada correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" })
    }
}


export const deleteFixedTransaction = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from("fixed_transactions").delete().eq("id", id);

        if (error) res.status(404).json({ error: "Error al eliminar la transacción" });

        res.status(200).json({ message: "Transacción eliminada correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" })
    }
}

export const deleteFixedTransactions = async (req, res) => {
    const { ids } = req.body; // array de IDs
    try {
        const { error } = await supabase.from("fixed_transactions").delete().in("id", ids); // 👈 elimina todos los que coincidan

        if (error) return res.status(400).json({ error: "Error al eliminar transacciones fijas" });

        res.status(200).json({ message: "Transacciones eliminadas correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error del Servidor" });
    }
};


export const getFixedTransactionsByPlayer = async (req, res) => {
    const { playerId } = req.params;

    try {
        const { data, error } = await supabase.from("fixed_transactions").select().eq("player_id", playerId)

        if (error) res.status(404).json({ error: "Error al obtener las transacciones fijas" });

        res.status(200).json(data);
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}