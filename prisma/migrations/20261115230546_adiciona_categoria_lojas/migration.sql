-- AlterTable
ALTER TABLE "Lojas" ADD COLUMN     "categoria_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Lojas" ADD CONSTRAINT "Lojas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
