

export const addPlayerMiddleware = (req, res, next) => {
    if (req.body.name && req.body.birth_date) {
        next();
    } else {
        res.send("Data incompleta");
    }
}