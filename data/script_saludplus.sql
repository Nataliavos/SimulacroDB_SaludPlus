
CREATE TABLE IF NOT EXISTS patients (
	patient_id serial NOT NULL UNIQUE,
	name varchar(255) NOT NULL,
	email varchar(255) NOT NULL UNIQUE,
	phone varchar(20) NOT NULL,
	address varchar(255),
	PRIMARY KEY(patient_id)
);


CREATE TABLE IF NOT EXISTS specialties (
	specialty_id serial NOT NULL UNIQUE,
	specialty varchar(255) NOT NULL UNIQUE,
	PRIMARY KEY(specialty_id)
);

CREATE TABLE IF NOT EXISTS treatments (
	treatment_code varchar(255) NOT NULL UNIQUE,
	description varchar(255) NOT NULL,
	cost numeric(12, 2) NOT NULL,
	PRIMARY KEY(treatment_code)
);

CREATE TABLE IF NOT EXISTS insurance_providers (
	insurance_id serial NOT NULL UNIQUE,
	insurance_name varchar(255) NOT NULL UNIQUE,
	coverage_percentage int NOT NULL,
	PRIMARY KEY(insurance_id)
);

CREATE TABLE IF NOT EXISTS doctors (
	doctor_id serial PRIMARY KEY,
	doctor_name varchar(255) NOT NULL,
	doctor_email varchar(255) NOT NULL UNIQUE,
	specialty_id int,
	CONSTRAINT fk_doctors_specialties
	FOREIGN KEY (specialty_id)
    REFERENCES specialties(specialty_id)
);

CREATE TABLE IF NOT EXISTS appointments (
	appointment_id varchar(255) PRIMARY KEY,
	date date NOT NULL,
	patient_id int NOT NULL,
	doctor_id int NOT NULL,
	treatment_code varchar(255) NOT NULL,
	insurance_id int NOT NULL,
	amount_paid numeric(12, 2),
	
	CONSTRAINT fk_appointments_patients
	FOREIGN KEY(patient_id) REFERENCES patients(patient_id),

	CONSTRAINT fk_appointments_doctors
 	FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id),

	CONSTRAINT fk_appointments_insurance_providers
 	FOREIGN KEY(insurance_id) REFERENCES insurance_providers(insurance_id),

	CONSTRAINT fk_appointments_treatments 
 	FOREIGN KEY(treatment_code) REFERENCES treatments(treatment_code)
);