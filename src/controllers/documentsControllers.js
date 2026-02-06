import { supabase } from '../utils/Supabase.js';

export const uploadDocument = async (req, res) => {
    const { player_id } = req.body;
    const file = req.file;

    console.log("Upload request for player:", player_id);

    if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${player_id}/${Date.now()}.${fileExt}`;
        const filePath = fileName;

        console.log("Uploading to storage:", filePath);

        // Convert Buffer to Uint8Array for better compatibility with some environments
        const fileData = new Uint8Array(file.buffer);

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('player-documents')
            .upload(filePath, fileData, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error("Supabase Storage Upload error:", uploadError);
            return res.status(500).json({
                error: "Error uploading to storage",
                details: uploadError.message
            });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('player-documents')
            .getPublicUrl(filePath);

        console.log("File uploaded, URL:", publicUrl);

        const { data, error } = await supabase
            .from('documents')
            .insert([{
                player_id: parseInt(player_id),
                name: file.originalname,
                url: publicUrl,
                supabase_path: filePath
            }])
            .select();

        if (error) {
            console.error("Database Insert error:", error);
            // Cleanup storage if database insert fails
            await supabase.storage.from('player-documents').remove([filePath]);
            return res.status(500).json({
                error: "Error saving document metadata",
                details: error.message
            });
        }

        console.log("Document saved to database:", data[0].id);
        res.status(200).json(data[0]);
    } catch (error) {
        console.error("Server error during upload:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const getDocumentsByPlayer = async (req, res) => {
    const { playerId } = req.params;

    console.log("Fetching documents for player:", playerId);

    if (!playerId || playerId === "undefined") {
        return res.status(400).json({ error: "Invalid player ID" });
    }

    try {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('player_id', parseInt(playerId))
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Database Fetch error:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        console.error("Server error during fetch:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

export const deleteDocument = async (req, res) => {
    const { id } = req.params;

    console.log("Delete request for document:", id);

    try {
        // 1. Get document info to find storage path
        const { data: doc, error: fetchError } = await supabase
            .from('documents')
            .select('supabase_path')
            .eq('id', id)
            .single();

        if (fetchError || !doc) {
            console.error("Document not found for deletion:", id, fetchError);
            return res.status(404).json({ error: "Document not found" });
        }

        console.log("Deleting file from storage:", doc.supabase_path);

        // 2. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('player-documents')
            .remove([doc.supabase_path]);

        if (storageError) {
            console.error("Storage delete error:", storageError);
            // We continue to delete from DB even if storage delete fails or file was already gone
        }

        // 3. Delete from DB
        const { error: dbError } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);

        if (dbError) {
            console.error("Database Delete error:", dbError);
            return res.status(500).json({ error: "Error deleting from database", details: dbError.message });
        }

        console.log("Document deleted successfully");
        res.json({ message: "Document deleted successfully" });
    } catch (error) {
        console.error("Server error during deletion:", error);
        res.status(500).json({ error: "Server error", details: error.message });
    }
};
