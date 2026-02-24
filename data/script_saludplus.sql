
CREATE TABLE IF NOT EXISTS appointment (
	appointment_date date NOT NULL UNIQUE,
	patient_id int,
	doctor_id int,
	treatment_code varchar(255),
	amount_paid int,
	PRIMARY KEY(appointment_date)
);


CREATE TABLE IF NOT EXISTS doctor (
	doctor_id serial NOT NULL UNIQUE,
	doctor_name varchar(255),
	doctor_email varchar(255),
	speciality_id int,
	PRIMARY KEY(doctor_id)
);


CREATE TABLE IF NOT EXISTS patient (
	patient_id serial NOT NULL UNIQUE,
	patient_name varchar(255),
	patient_email varchar(255),
	patient_phone int,
	patient_address varchar(255),
	insurance_id int,
	PRIMARY KEY(patient_id)
);


CREATE TABLE IF NOT EXISTS speciality (
	speciality_id serial NOT NULL UNIQUE,
	speciality varchar(255),
	PRIMARY KEY(speciality_id)
);


CREATE TABLE IF NOT EXISTS treatment (
	treatment_code varchar(255) NOT NULL UNIQUE,
	treatment_description varchar(255),
	treatment_cost int,
	PRIMARY KEY(treatment_code)
);


CREATE TABLE IF NOT EXISTS insurance_provider (
	insurance_id serial NOT NULL UNIQUE,
	insurance_provider varchar(255),
	coverage_percentage int,
	PRIMARY KEY(insurance_id)
);


ALTER TABLE appointment
ADD FOREIGN KEY(patient_id) REFERENCES patient(patient_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE appointment
ADD FOREIGN KEY(doctor_id) REFERENCES doctor(doctor_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE appointment
ADD FOREIGN KEY(treatment_code) REFERENCES treatment(treatment_code)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE doctor
ADD FOREIGN KEY(speciality_id) REFERENCES speciality(speciality_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE patient
ADD FOREIGN KEY(insurance_id) REFERENCES insurance_provider(insurance_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;