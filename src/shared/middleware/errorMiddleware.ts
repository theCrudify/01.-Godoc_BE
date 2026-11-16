import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        // Error tak terduga (5xx) jangan bocorkan detail internal ke client
        message: (err.expose || err.name === 'MulterError' || (err.status && err.status < 500)) ? err.message : 'Internal Server Error',
    });
};
