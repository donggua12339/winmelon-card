USE wmcard;

ALTER TABLE merchant_applications MODIFY COLUMN contactName VARCHAR(64) NULL;

DESCRIBE merchant_applications;