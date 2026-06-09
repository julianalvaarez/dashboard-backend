export const addPlayerMiddleware = (req, res, next) => {
    if (req.body && req.body.name && req.body.birth_date) {
        next();
    } else {
        res.status(400).send("Data incompleta");
    }
}