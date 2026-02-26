
CREATE TABLE IF NOT EXISTS appointments (
	appointment_id varchar(255) NOT NULL UNIQUE,
	appointment_date date NOT NULL,
	patient_id int,
	doctor_id int,
	treatment_code varchar(255) NOT NULL,
	amount_paid int,
	PRIMARY KEY(appointment_date)
);


CREATE TABLE IF NOT EXISTS doctors (
	doctor_id serial NOT NULL UNIQUE,
	doctor_name varchar(255) NOT NULL,
	doctor_email varchar(255) NOT NULL UNIQUE,
	speciality_id int,
	PRIMARY KEY(doctor_id)
);


CREATE TABLE IF NOT EXISTS patients (
	patient_id serial NOT NULL UNIQUE,
	patient_name varchar(255) NOT NULL,
	patient_email varchar(255) NOT NULL UNIQUE,
	patient_phone int NOT NULL,
	patient_address varchar(255),
	insurance_id int,
	PRIMARY KEY(patient_id)
);


CREATE TABLE IF NOT EXISTS specialities (
	speciality_id serial NOT NULL UNIQUE,
	speciality varchar(255) NOT NULL UNIQUE,
	PRIMARY KEY(speciality_id)
);


CREATE TABLE IF NOT EXISTS treatments (
	treatment_code varchar(255) NOT NULL UNIQUE,
	treatment_description varchar(255) NOT NULL,
	treatment_cost int NOT NULL,
	PRIMARY KEY(treatment_code)
);


CREATE TABLE IF NOT EXISTS insurance_providers (
	insurance_id serial NOT NULL UNIQUE,
	insurance_provider varchar(255) NOT NULL UNIQUE,
	coverage_percentage int NOT NULL,
	PRIMARY KEY(insurance_id)
);


ALTER TABLE appointments
ADD FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE appointments
ADD FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE appointments
ADD FOREIGN KEY(treatment_code) REFERENCES treatments(treatment_code)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE doctors
ADD FOREIGN KEY(speciality_id) REFERENCES specialities(speciality_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE patients
ADD FOREIGN KEY(insurance_id) REFERENCES insurance_providers(insurance_id)
ON UPDATE NO ACTION ON DELETE NO ACTION;