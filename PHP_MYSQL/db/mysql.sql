CREATE TABLE IF NOT EXISTS sale_documents (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference        VARCHAR(32)  NOT NULL UNIQUE,
  property_address VARCHAR(255) NOT NULL,
  city             VARCHAR(100) NOT NULL,
  property_type    ENUM('apartment','house','land','commercial') NOT NULL,
  price            DECIMAL(12,2) NOT NULL,
  sale_date        DATE NOT NULL,
  status           ENUM('draft','pending','signed','completed','cancelled') NOT NULL DEFAULT 'draft',
  document_type    VARCHAR(64) NOT NULL,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO sale_documents
  (reference, property_address, city, property_type, price, sale_date, status, document_type)
VALUES
  ('SD-2026-0001','12 Rue des Lilas','Lyon','apartment',245000.00,'2026-01-12','signed','Compromis de vente'),
  ('SD-2026-0002','8 Avenue du Parc','Bordeaux','house',480000.00,'2026-01-28','pending','Mandat de vente'),
  ('SD-2026-0003','45 Chemin des Vignes','Nantes','house',312500.00,'2026-02-03','completed','Acte authentique'),
  ('SD-2026-0004','3 Place du Marché','Lille','commercial',620000.00,'2026-02-14','draft','Lettre d''intention'),
  ('SD-2026-0005','Lot 27 - ZAC des Chênes','Toulouse','land',98000.00,'2026-02-20','signed','Promesse de vente'),
  ('SD-2026-0006','101 Boulevard Voltaire','Paris','apartment',735000.00,'2026-03-02','pending','Compromis de vente'),
  ('SD-2026-0007','5 Impasse des Roses','Marseille','apartment',189000.00,'2026-03-11','completed','Acte authentique'),
  ('SD-2026-0008','22 Route de la Forêt','Strasbourg','house',398000.00,'2026-03-19','cancelled','Mandat de vente');