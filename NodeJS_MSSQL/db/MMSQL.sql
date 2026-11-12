/* ------------------------------------------------------------------
   Table
   - INT UNSIGNED AUTO_INCREMENT  -> INT IDENTITY(1,1)
   - UNIQUE on reference           -> UNIQUE constraint
   - ENUM(...)                     -> CHECK constraint
   - ON UPDATE CURRENT_TIMESTAMP   -> AFTER UPDATE trigger (below)
   - ENGINE=InnoDB                 -> not applicable
   ------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.sale_documents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sale_documents
    (
        id               INT            IDENTITY(1,1) NOT NULL,
        reference        NVARCHAR(32)   NOT NULL,
        property_address NVARCHAR(255)  NOT NULL,
        city             NVARCHAR(100)  NOT NULL,
        property_type    NVARCHAR(20)   NOT NULL,
        price            DECIMAL(12,2)  NOT NULL,
        sale_date        DATE           NOT NULL,
        status           NVARCHAR(20)   NOT NULL
            CONSTRAINT DF_sale_documents_status DEFAULT (N'draft'),
        document_type    NVARCHAR(64)   NOT NULL,
        updated_at       DATETIME2(0)   NOT NULL
            CONSTRAINT DF_sale_documents_updated_at DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_sale_documents
            PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_sale_documents_reference
            UNIQUE (reference),
        CONSTRAINT CK_sale_documents_property_type
            CHECK (property_type IN (N'apartment', N'house', N'land', N'commercial')),
        CONSTRAINT CK_sale_documents_status
            CHECK (status IN (N'draft', N'pending', N'signed', N'completed', N'cancelled'))
    );
END;
GO

/* ------------------------------------------------------------------
   Emulate MySQL's ON UPDATE CURRENT_TIMESTAMP
   ------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.trg_sale_documents_updated_at', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_sale_documents_updated_at;
GO

CREATE TRIGGER dbo.trg_sale_documents_updated_at
ON dbo.sale_documents
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Avoid recursion: only bump the column if the caller didn't set it explicitly
    IF NOT UPDATE(updated_at)
    BEGIN
        UPDATE d
           SET d.updated_at = SYSDATETIME()
          FROM dbo.sale_documents AS d
          INNER JOIN inserted AS i ON i.id = d.id;
    END
END;
GO

/* ------------------------------------------------------------------
   Seed data (INSERT IGNORE -> anti-join on the UNIQUE key)
   ------------------------------------------------------------------ */
INSERT INTO dbo.sale_documents
    (reference, property_address, city, property_type, price, sale_date, status, document_type)
SELECT v.reference, v.property_address, v.city, v.property_type,
       v.price, v.sale_date, v.status, v.document_type
FROM (VALUES
    (N'SD-2026-0001', N'12 Rue des Lilas',           N'Lyon',       N'apartment',  245000.00, '2026-01-12', N'signed',    N'Compromis de vente'),
    (N'SD-2026-0002', N'8 Avenue du Parc',           N'Bordeaux',   N'house',      480000.00, '2026-01-28', N'pending',   N'Mandat de vente'),
    (N'SD-2026-0003', N'45 Chemin des Vignes',       N'Nantes',     N'house',      312500.00, '2026-02-03', N'completed', N'Acte authentique'),
    (N'SD-2026-0004', N'3 Place du Marché',          N'Lille',      N'commercial', 620000.00, '2026-02-14', N'draft',     N'Lettre d''intention'),
    (N'SD-2026-0005', N'Lot 27 - ZAC des Chênes',    N'Toulouse',   N'land',        98000.00, '2026-02-20', N'signed',    N'Promesse de vente'),
    (N'SD-2026-0006', N'101 Boulevard Voltaire',     N'Paris',      N'apartment',  735000.00, '2026-03-02', N'pending',   N'Compromis de vente'),
    (N'SD-2026-0007', N'5 Impasse des Roses',        N'Marseille',  N'apartment',  189000.00, '2026-03-11', N'completed', N'Acte authentique'),
    (N'SD-2026-0008', N'22 Route de la Forêt',       N'Strasbourg', N'house',      398000.00, '2026-03-19', N'cancelled', N'Mandat de vente')
) AS v (reference, property_address, city, property_type, price, sale_date, status, document_type)
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.sale_documents AS d
    WHERE d.reference = v.reference
);
GO