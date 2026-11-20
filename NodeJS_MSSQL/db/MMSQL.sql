/* ------------------------------------------------------------------
   Sale documents — MSSQL schema and seed data
   - INT UNSIGNED AUTO_INCREMENT  -> INT IDENTITY(1,1)
   - UNIQUE on reference           -> UNIQUE constraint
   - ENUM(...)                     -> CHECK constraint
   - ON UPDATE CURRENT_TIMESTAMP   -> AFTER UPDATE trigger (below)
   - ENGINE=InnoDB                 -> not applicable

   Seed data uses Hong Kong properties and HKD prices so the MSSQL mode
   matches the in-memory demo data in src/data.js.
   Property names / addresses are from Chinachem Group public listings.
   Prices and documents are DEMO DATA for the APM demonstration only.
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
    (N'SD-2026-0001', N'8 Tak Hing Street, Tsim Sha Tsui',        N'Kowloon',        N'apartment', 24500000.00, '2026-01-12', N'signed',    N'臨時買賣合約 / Preliminary Agreement'),
    (N'SD-2026-0002', N'28 Tonkin Street, Cheung Sha Wan',        N'Kowloon',        N'apartment', 12800000.00, '2026-01-28', N'pending',   N'正式買賣合約 / Formal Agreement'),
    (N'SD-2026-0003', N'1 Chung Hau Street, Ho Man Tin',          N'Kowloon',        N'apartment', 18650000.00, '2026-02-03', N'completed', N'轉讓契 / Assignment'),
    (N'SD-2026-0004', N'18 Pak Pat Shan Road, Tai Tam',           N'Hong Kong',      N'house',     62000000.00, '2026-02-14', N'draft',     N'售樓說明書 / Sales Brochure'),
    (N'SD-2026-0005', N'42 Kotewall Road, Mid-Levels',            N'Hong Kong',      N'apartment', 39800000.00, '2026-02-20', N'signed',    N'價單 / Price List'),
    (N'SD-2026-0006', N'No. 301 Victoria Road, Pok Fu Lam',       N'Hong Kong',      N'apartment', 21700000.00, '2026-03-02', N'pending',   N'臨時買賣合約 / Preliminary Agreement'),
    (N'SD-2026-0007', N'162 Hiram''s Highway, Hebe Haven',        N'New Territories',N'house',     47500000.00, '2026-03-11', N'completed', N'轉讓契 / Assignment'),
    (N'SD-2026-0008', N'18 Pak Pat Shan Road, Tai Tam',           N'Hong Kong',      N'house',     58900000.00, '2026-03-19', N'cancelled', N'正式買賣合約 / Formal Agreement')
) AS v (reference, property_address, city, property_type, price, sale_date, status, document_type)
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.sale_documents AS d
    WHERE d.reference = v.reference
);
GO
