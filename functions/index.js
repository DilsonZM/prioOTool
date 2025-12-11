const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Trigger: Cuando se elimina un documento en la colección 'users'.
 * Acción: Elimina la cuenta de autenticación asociada al ID del documento.
 */
exports.deleteUserAuth = functions.firestore
    .document('users/{userId}')
    .onDelete(async (snap, context) => {
        const userId = context.params.userId;
        console.log(`Iniciando eliminación de Auth para el usuario: ${userId}`);

        try {
            await admin.auth().deleteUser(userId);
            console.log(`✅ Usuario ${userId} eliminado de Firebase Auth correctamente.`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`⚠️ El usuario ${userId} ya no existía en Auth.`);
            } else {
                console.error(`❌ Error al eliminar usuario ${userId} de Auth:`, error);
            }
        }
    });
