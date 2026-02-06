import { supabase } from '../utils/Supabase.js';

export const getPlayers = async (req, res) => {

    try {
        const { data: players, error: playerError } = await supabase.from("players").select();
        if (playerError) return res.status(500).json({ error: playerError.message });

        // 2. Obtener todas las transacciones
        const { data: transactions, error: txError } = await supabase.from('transactions').select();
        if (txError) return res.status(500).json({ error: txError.message });

        // 3. Agrupar transacciones por jugador
        const playersWithTx = players.map(player => {
            const playerTx = transactions.filter(tx => tx.player_id === player.id);
            return {
                ...player,
                transactions: playerTx
            };
        });

        res.json(playersWithTx);
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}

export const getPlayerById = async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from("players").select().eq("id", id);
        if (error) {
            console.error("Error al obtener el jugador", error);
            return res.status(404).json({ error: "Error al obtener el jugador" });
        }
        if (data.length === 0) {
            return res.status(404).json({ error: "Jugador no encontrado" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}


export const updatePlayer = async (req, res) => {
    const { id } = req.params;
    const playerData = req.body;
    try {
        const { error } = await supabase.from("players").update([{ ...playerData }]).eq("id", id);
        if (error) {
            console.error("Error al actualizar el jugador", error);
            return res.status(404).json({ error: "Error al actualizar el jugador" });
        }

        res.status(200).json({ message: "Jugador actualizado correctamente" });
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}


export const deletePlayer = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from("players").delete().eq("id", id);
        if (error) {
            console.error("Error al eliminar el jugador", error);
            return res.status(404).json({ error: "Error al eliminar el jugador" });
        }

        res.status(200).json({ message: "Jugador eliminado correctamente" });
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}


export const addPlayer = async (req, res) => {
    const playerData = req.body
    try {
        const { data, error } = await supabase.from("players").insert([{ ...playerData }]);
        if (error) {
            console.error("Error al crear el jugador", error);
            return res.status(404).json({ error: "Error al crear el jugador" });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error del Servidor" })
    }
}